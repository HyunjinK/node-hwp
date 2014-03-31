var assert = require('assert'),
	fs = require('fs'),
	util = require('util'),
	XMLDoc = require('xmldoc');
var hwp = require('../');

var files = [
	"text_3",
	"text_1",
	"text_2",
	"text_3",
	"shape_simple_1",
	"shape_simple_2",
	"shape_simple_3",
	"shape_fill_1",
];

/*
	XXX:
		There are sometimes additional BORDERFILLs in ref
		BorderFill in PAGEBORDERFILL is mis-spelled in BorferFill in HML files generated by Hangul
		Default HML generation of HWP is bad; especially when MARKPEN is used.
	TODO:
		Find informations about PARAHEAD[Start]
		Confirm default values of STYLE[LockForm], SECDEF[TextVerticalWidthHead]
		Find informations about COMPATIBLEDOCUMENT
		Find out why STARTNUMBER[Page] are different
		Find out how NOTELINE[Length] is saved in record (5cm = -1?)
		Process TAIL
*/

var ignores = {
	'attr': {
		'BORDERFILLLIST': "Count",
		'PARAHEAD': "Start",
		'STYLE': "LockForm",
		'PAGEBORDERFILL': "BorferFill", // lol
		'SECDEF': "TextVerticalWidthHead",
		'STARTNUMBER': "Page",
		'NOTELINE': "Length",
	},
	'children': [
	],
	'node': [
		'COMPATIBLEDOCUMENT',
		'CHAR',
		'TAIL'
	],
	'empty': [
		'TEXT'
	]
};

(function(){
	var x;
	for(x in ignores.attr) ignores.attr[x] = ignores.attr[x].split(' ');
}());

// s가 n과 비슷한지 확인
var same_num_rep = function(n, s){
	if(n == +s) return true;
	if(s.indexOf('.') == -1) return false;
	return s == n.toFixed(s.split('.')[1].length);
};

var check_file = function(file, callback){
	var check_stack = [0];
	// Border Fill Difference
	var bfd = 0;
	var check_file_rec = function check(hml, ref, lev){
		try{
			check_stack[lev] = hml.name+"["+check_stack[lev]+"]";
			assert.equal(hml.name, ref.name, "Different tag");
			var hml_attr_keys = Object.keys(hml.attr).filter(function(x){return hml.attr[x] != null}),
				ref_attr_keys = Object.keys(ref.attr);
			ref_attr_keys.forEach(function(x){
				if(!(hml.name in ignores.attr) || ignores.attr[hml.name].indexOf(x) == -1){
					if(hml.attr[x] == null) assert.fail(hml.attr[x], ref.attr[x], "Attribute does not exist ('"+x+"')");
					var msg = "Different attribute ('"+x+"')", ha = hml.attr[x], ra = ref.attr[x];
					// Adjust BorderFillId
					if(hml.name == 'BORDERFILL' && x == 'Id'
						|| x == 'BorderFill' || x == 'BorderFillId') ha = (+ha)+bfd;
					if(typeof hml.attr[x] == 'number') assert.ok(same_num_rep(ha, ra), msg);
					else assert.equal(ha.toString(), ra, msg);
				}
			});
			var rv = ref.val;
			if(rv && 'encoding' in hml) switch(hml.encoding){
				case 'base64':
					rv = rv.replace(/\s/g, '');
					break;
			}
			assert.equal(hml.getEncodedValue() || "", rv, "Different value");
			assert.ok(hml.children.length <= ref.children.length, "HML too long");
		}catch(e){
			console.error("File '"+file+"': At "+check_stack.join(" > "));
			console.error("HML:", util.inspect(hml, {'depth': 1}));
			console.error("REF:", util.inspect(ref, {'depth': 1}));
			throw e;
		}
		if(ignores.children.indexOf(hml.name) == -1){
			var i=0, j=0;
			if(hml.name == 'BORDERFILLLIST'){
				bfd = ref.children.length - hml.children.length;
				if(bfd != 0 && bfd != 1) assert.fail(hml.children.length, ref.children.length, "Difference too big in BORDERFILLLIST");
				i = bfd;
			}
			for(;i<ref.children.length;i++){
				var rc = ref.children[i];
				if(!rc.value && !rc.children.length && ignores.empty.indexOf(rc.name) != -1) continue;
				if(j >= hml.children.length && ignores.node.indexOf(rc.name) == -1){
					console.error("File '"+file+"': At "+check_stack.join(" > "));
					console.error("HML:", util.inspect(hml.children, {'depth': 1}));
					console.error("REF:", util.inspect(ref.children, {'depth': 1}));
					assert.fail(hml.children.length, ref.children.length, "Missing child: "+rc.name);
				}
				if(ignores.node.indexOf(rc.name) == -1){
					check_stack.push(i==j?i:(j+1)+":"+(i+1));
					try{
						check(hml.children[j++], rc, lev+1);
					}catch(e){
						throw e;
					}
				}
			}
		}
		check_stack.pop();
	};
	console.log("Opening "+file+".hwp");
	hwp.open("./test/files/"+file+".hwp", function(err, doc){
		assert.ifError(err);
		var ref = new XMLDoc.XmlDocument(fs.readFileSync("./test/files/"+file+".hml", 'utf8'));
		check_file_rec(doc._hml, ref, 0);
		callback();
	});
};

var test = function(ok){
	var inner_loop = function f(ind){
		if(ind == files.length) ok();
		else check_file(files[ind], f.bind(null, ind+1));
	};
	inner_loop(0);
};

module.exports = {
	'description': "Reads HWP document and compare it to reference HML files.",
	'run': test
};

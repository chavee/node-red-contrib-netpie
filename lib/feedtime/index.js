const ms = require('./ms');

// new Date('xxxx-xx-xx xx:xx:xx') assuem the input time is of a local timezone
// if want to specify timezone use  --> new Date('xxxx-xx-xx xx:xx:xx+0:00')

module.exports.parse = function(tm) {
	let out;
	out = new Date(tm).getTime();
	if (typeof(out)=='number' && !isNaN(out)) return out;
	else {
 		let dur = ms(tm);
 		if (dur !== undefined) {
 			if (dur > 0) return Date.now() - dur;		// 1h is the same as -1h
 			else return Date.now() + dur;
 		}
 		else {
	 		return undefined;
 		}

	}
}
describe("nexpietime", function() {
	const nexpietime = require('../index.js');

	before(function(done) {
		done();
	});

	it("should accept time in string format 2021-08-12 08:30:00", function(done) {
		expect(nexpietime.parse('2021-08-12 08:30:00+7:00')).to.be.above(0);
		done();
	});

	it("should take unix timestamp and return the same value", function(done) {
		expect(nexpietime.parse(1628731800000)).to.equal(1628731800000);
		done();
	});

	it("should return timestamp", function(done) {
		expect(nexpietime.parse('2021-08-12 08:30:00+7:00')).to.equal(1628731800000);
		expect(nexpietime.parse('1970-01-01 07:00:00+7:00')).to.equal(0);
		expect(nexpietime.parse('1970-01-01 07:00:00+7')).to.equal(0);
		done();
	});

	it("should accept relative time string 1h as 1 hour ago", function(done) {
		expect(nexpietime.parse('1h')).to.equal(Date.now() - 60*60*1000);
		expect(nexpietime.parse('-1h')).to.equal(Date.now() - 60*60*1000);
		done();
	});

	it("should accept relative time string 1 h as 1 hour ago", function(done) {
		expect(nexpietime.parse('1 h')).to.equal(Date.now() - 60*60*1000);
		expect(nexpietime.parse('-1 h')).to.equal(Date.now() - 60*60*1000);
		done();
	});

	it("should accept relative time string 0 h as now", function(done) {
		expect(nexpietime.parse('0 h')).to.equal(Date.now());
		expect(nexpietime.parse('-0 h')).to.equal(Date.now());
		done();
	});

	it("should accept relative time string 1.5hrs as last 1.5 hour ago", function(done) {
		expect(nexpietime.parse('1.5hrs')).to.equal(Date.now() - 1.5*60*60*1000);
		expect(nexpietime.parse('-1.5hrs')).to.equal(Date.now() - 1.5*60*60*1000);
		done();
	});

	it("should accept relative time string 2hours as 2 hours ago", function(done) {
		expect(nexpietime.parse('2hours')).to.equal(Date.now() - 2*60*60*1000);
		expect(nexpietime.parse('-2hours')).to.equal(Date.now() - 2*60*60*1000);
		done();
	});

	it("should accept relative time string 1m as 1 minute ago", function(done) {
		expect(nexpietime.parse('1m')).to.equal(Date.now() - 1*60*1000);
		expect(nexpietime.parse('-1m')).to.equal(Date.now() - 1*60*1000);
		done();
	});

	it("should accept relative time string 1s as 1 second ago", function(done) {
		expect(nexpietime.parse('1s')).to.equal(Date.now() - 1*1000);
		expect(nexpietime.parse('-1s')).to.equal(Date.now() - 1*1000);
		done();
	});

	it("should accept relative time string 1d as 1 day ago", function(done) {
		expect(nexpietime.parse('1d')).to.equal(Date.now() - 24*60*60*1000);
		expect(nexpietime.parse('-1d')).to.equal(Date.now() - 24*60*60*1000);
		done();
	});

	it("should accept relative time string 1d as 1 day ago", function(done) {
		expect(nexpietime.parse('1d')).to.equal(Date.now() - 24*60*60*1000);
		expect(nexpietime.parse('-1d')).to.equal(Date.now() - 24*60*60*1000);
		done();
	});

	it("should accept now as the crrent time", function(done) {
		expect(nexpietime.parse('now')).to.equal(Date.now() );
		done();
	});


	// it("should accept relative time string 1month as 1 month ago", function(done) {
	// 	expect(nexpietime.parse('1month')).to.equal(Date.now() - 24*60*60*1000);
	// 	expect(nexpietime.parse('-1month')).to.equal(Date.now() - 24*60*60*1000);
	// 	done();
	// });

	// it("should accept relative time string 2month as 1 month ago", function(done) {
	// 	expect(nexpietime.parse('2months')).to.equal(Date.now() - 24*60*60*1000);
	// 	expect(nexpietime.parse('-2months')).to.equal(Date.now() - 24*60*60*1000);
	// 	done();
	// });

});

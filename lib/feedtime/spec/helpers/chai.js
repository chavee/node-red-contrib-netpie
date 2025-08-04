var chai = require('chai');
chai.use(require('chai-things'));
chai.use(require('chai-each'));
chai.config.includeStack = false;

global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;

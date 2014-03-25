var less = require('less');
var fs = require('fs');
var Q = require('Q');
var _ = require('underscore');


var lessParse = function(parser, lessData){
  var deferred = Q.defer();
  parser.parse(lessData, function(e, tree){
    if (e){
      deferred.reject(e);
    } else {
      deferred.resolve(tree);
    }
  })

  return deferred.promise;
}

var readAndGetVars = function(lessFile, env) {
  var lessData = fs.readFileSync(lessFile, {'encoding': 'utf8'});
  var parser = new(less.Parser)(env);

  return lessParse(parser, lessData).then(function(t){
  return Object.keys(t.variables());
  });
}

/**
 * creates a less file of css classes whose names
 * are identical to the variables they are matching
 * the only rule for this class is .about( @varname; }
 * see audit.less for more info about this guarded mixin
 * @param  {array} varNames a list of less vars from
 *                          tree.variables()
 * @return {string}         a generated string of parseable less
 *                          provided you @import "audit.less";
 */
var auditVars = function(varNames) {
  var generatedLess = '';
  for (var i=0; i<varNames.length; i+= 1) {
    var v = varNames[i];
    generatedLess += '.' + v.slice(1) +' { .about('+ v +'); }\n';
  }
  return Q(generatedLess)
}

/**
 * literally outputs, from a list of less variables
 * a structure .vals {varName: @varName; }
 * which gets parsed by less into
 * .vals { varname: <varValue>, ... }
 * @param  {array} varNames a list of variable names from
 *                          tree.variables()
 * @return {string}         a string of less which looks like
 *                          .vals { varName: @varName; ... }
 */
var literalVars = function(varNames) {
  var generatedLess = '.vals{\n';
  for (var i=0; i<varNames.length; i+= 1) {
    var v = varNames[i];
    generatedLess += v.slice(1) + ': ' + v + ';\n';
  }
  generatedLess += '}';
  return generatedLess;
}

/**
 * generates a function which parses some less after importing
 * importFile
 * @param  {string} importFile the path of a less file containing
 *                             less variables
 * @return {less.tree}         a less 'tree' that you can call
 *                             .toCSS() on
 */
var parseWithImport = function(importFile){
  return function(lessString) {
    var lessData = '@import "' + importFile + '";\n' +
      lessString;
    var parser = new(less.Parser)(config.env);

    return lessParse(parser, lessData);
  }
}

var loadConfig = function(configFile){
  configFile = configFile || 'config.json';

  configData = fs.readFileSync(configFile, {'encoding': 'utf8'});
  return JSON.parse(configData);
}

var lessVarsAsJSON = function() {
  return readAndGetVars(config.varFile, config.env)
    .then(literalVars) // .then(auditVars) // for var mixin auditing
    .then(parseWithImport(config.varFile))
    .then(function(lessTree){
      // spit out the compiled less
      return lessTree.toCSS();
    })
    .then(function(css){
      // turns css-pseudo-json into actual json
      var op = css.indexOf('{');
      var cp = css.indexOf('}');
      var notBlock = css
        .substring(op+1, cp)
        .trim()
        .split('\n');

      out = {}
      for (var i=0; i<notBlock.length; i+=1){
        var s = notBlock[i].split(':');
        var k = s[0].trim();
        var v = s[1].split(';')[0].trim();
        out[k] = v;
      }

      return out;
    });
}


var config = loadConfig();

lessVarsAsJSON().then(function(v){
  console.log(JSON.stringify(v))
})

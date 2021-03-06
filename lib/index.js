"use strict";

var parser = require("@babel/parser");
var traverse = require("babel-traverse").default;
var t = require("babel-types");
var template = require("@babel/template");
var core = require("@babel/core");
var LIMIT_LINE = 0;

module.exports = function (source) {
  // 1、解析
  var ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["dynamicImport"]
  });

  // 2、遍历
  traverse(ast, {
    FunctionExpression: function FunctionExpression(path, state) {
      // Function 节点
      var node = path.node,
          params = node.params,
          blockStatement = node.body,
          // 函数function内部代码，将函数内部代码块放入 try 节点
      isGenerator = node.generator,
          isAsync = node.async;

      // =================================== 边界情况 return 处理 ============================
      // 1、如果有try catch包裹了，则不需要
      // 2、防止 circle loops 
      // 3、需要 try catch 的只能是语句，像 () => 0 这种的 body，是不需要的
      // 4、如果函数内容小于等于 LIMIT_LINE 行不去 try/catch，当然这个函数可以暴露出来给用户设置
      if (blockStatement.body && t.isTryStatement(blockStatement.body[0]) || !t.isBlockStatement(blockStatement) && !t.isExpressionStatement(blockStatement) || blockStatement.body && blockStatement.body.length <= LIMIT_LINE) {
        return;
      }

      // 创建 catch 节点中的代码
      var catchStatement = template.statement("ErrorCapture(error)")();
      console.log(catchStatement, 88);
      var catchClause = t.catchClause(t.identifier('error'), t.blockStatement([catchStatement] //  catchBody
      ));

      // 创建 try/catch 的 ast
      var tryStatement = t.tryStatement(blockStatement, catchClause);
      // 创建新节点
      var func = null;
      // 判断：类方法、对象方法、函数申明、函数表达式
      if (t.isClassMethod(node)) {
        // 用 t.classMethod 生成 ast
        func = t.classMethod(node.kind, node.key, params, t.BlockStatement([tryStatement]), node.computed, node.static); // t.BlockStatement([tryStatement]) 新的 ast 节点
      } else if (t.isObjectMethod(node)) {
        func = t.objectMethod(node.kind, node.key, params, t.BlockStatement([tryStatement]), node.computed);
      } else if (t.isFunctionDeclaration(node)) {
        func = t.functionDeclaration(node.id, params, t.BlockStatement([tryStatement]), isGenerator, isAsync);
      } else {
        func = t.functionExpression(node.id, params, t.BlockStatement([tryStatement]), isGenerator, isAsync);
      }

      // 替换原节点
      path.replaceWith(func);
    }
  });

  // 3、生成source源码
  return core.transformFromAstSync(ast, null, {
    configFile: false
  }).code;
};
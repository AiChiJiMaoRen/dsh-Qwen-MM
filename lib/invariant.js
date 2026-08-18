// C:/Users/linha/dsh-plugins/dsh-qwen-mm/src/invariant.ts
var PACKAGE_NAME = "@deepseek-ai/dsh-qwen-mm";
var name = "qwen-mm-invariant";
var inject = ["invariants"];
var install = () => {
};
var apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
export {
  apply,
  inject,
  name
};

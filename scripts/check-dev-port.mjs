/**
 * 避免重复 `npm run dev`：若 3003 已被占用则直接退出，防止多棵 Next 进程树叠加。
 * 用法：由 package.json 的 dev 脚本在启动 next 前调用。
 */
import net from "node:net";

const port = parseInt(process.env.LOBSTER_DEV_PORT || "3003", 10);

const server = net.createServer();
server.once("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[lobster] 端口 ${port} 已被占用，请先结束占用该端口的进程，或不要重复执行 npm run dev。`,
    );
    process.exit(1);
  }
  throw err;
});
server.listen(port, () => {
  server.close(() => process.exit(0));
});

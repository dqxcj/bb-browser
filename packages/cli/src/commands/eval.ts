/**
 * eval 命令 - 在当前页面执行 JavaScript
 */

import type { Request, Response } from "@bb-browser/shared";
import { sendCommand } from "../client.js";
import { ensureDaemonRunning } from "../daemon-manager.js";

export interface EvalOptions {
  json?: boolean;
  tabId?: string | number;
}

export async function evalCommand(
  script: string,
  options: EvalOptions = {}
): Promise<void> {
  if (!script) throw new Error("缺少 script 参数");

  await ensureDaemonRunning();

  const request: Request = {
    method: "eval",
    script,
    tabId: options.tabId,
  };

  const response: Response = await sendCommand(request);

  if (options.json) {
    console.log(JSON.stringify(response, null, 2));
  } else {
    if (response.result) {
      const result = response.result?.result;
      if (result !== undefined) {
        if (typeof result === "object" && result !== null) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result);
        }
      } else {
        console.log("undefined");
      }
    } else {
      console.error(`错误: ${response.error?.message}`);
      process.exit(1);
    }
  }
}

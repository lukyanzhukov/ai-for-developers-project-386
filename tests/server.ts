import { fork } from "node:child_process";
import { once } from "node:events";
import type { MeetingType } from "../generated/api/types.gen.ts";

export async function startServer(meetingTypes: MeetingType[] = []) {
  const child = fork("tests/server-fixture.mjs", [], {
    env: { ...process.env, NODE_ENV: "production", MEETING_TYPES: JSON.stringify(meetingTypes) },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  async function close() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.kill("SIGTERM");
    await exited;
    clearTimeout(timer);
  }
  try {
    const address = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Server startup timed out: ${output}`)),
        10000,
      );
      child.once("message", (message: { address: string }) => {
        clearTimeout(timer);
        resolve(message.address);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited (${code}): ${output}`));
      });
    });
    return { address, close };
  } catch (error) {
    await close();
    throw error;
  }
}

import { Color } from "../../PMMPCore.js";

export function sendInfo(target, message) {
  target.sendMessage(`${Color.aqua}[PurePerms] ${Color.white}${message}${Color.reset}`);
}

export function sendSuccess(target, message) {
  target.sendMessage(`${Color.green}[PurePerms] ${message}${Color.reset}`);
}

export function sendError(target, message) {
  target.sendMessage(`${Color.red}[PurePerms] ${message}${Color.reset}`);
}

export function sendListHeader(target, title, page, totalPages) {
  target.sendMessage(`${Color.bold}${Color.yellow}=== ${title} (${page}/${totalPages}) ===${Color.reset}`);
}

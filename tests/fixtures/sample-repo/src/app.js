// Sample application file
import { UserService } from './services/userService.ts';

export function startApp() {
  console.log("App started");
  const service = new UserService();
  return service.getUser(1);
}

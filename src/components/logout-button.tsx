import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="button secondary" type="submit">
        <LogOut aria-hidden="true" size={18} />
        Log out
      </button>
    </form>
  );
}

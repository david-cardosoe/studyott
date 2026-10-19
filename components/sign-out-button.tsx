import { signOut } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" className="h-11 px-3 text-base">
        Sign out
      </Button>
    </form>
  );
}

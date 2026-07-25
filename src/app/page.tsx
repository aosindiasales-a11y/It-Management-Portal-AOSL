import { redirect } from "next/navigation";

/** Root route — always hands off to the dashboard or, via middleware, to /login. */
export default function RootPage() {
  redirect("/dashboard");
}

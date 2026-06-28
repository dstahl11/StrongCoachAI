import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/calendar");
  const { next } = await searchParams;
  return <LoginForm next={next ?? "/calendar"} />;
}

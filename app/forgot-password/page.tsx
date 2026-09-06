import AuthForm from "@/components/auth-form";
import { configured } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthForm mode="forgot" ready={configured()} />;
}

import { History } from "@/components/app-ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <History id={(await params).id} />;
}

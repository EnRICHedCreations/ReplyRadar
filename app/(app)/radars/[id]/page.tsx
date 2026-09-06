import { RadarForm } from "@/components/app-ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RadarForm id={(await params).id} />;
}

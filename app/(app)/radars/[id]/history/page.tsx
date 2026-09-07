import HistoryUI from "@/components/history-ui";
export default async function Page({params}:{params:Promise<{id:string}>}){return <HistoryUI id={(await params).id}/>;}

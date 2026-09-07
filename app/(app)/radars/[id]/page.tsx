import RadarEditor from "@/components/radar-editor";
export default async function Page({params}:{params:Promise<{id:string}>}){return <RadarEditor id={(await params).id}/>;}

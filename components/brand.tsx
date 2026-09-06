import { Radar } from "lucide-react";
import Link from "next/link";
export default function Brand() {
  return (
    <Link className="brand" href="/">
      <Radar size={26} />
      ReplyRadar<span className="sr-only"> home</span>
    </Link>
  );
}

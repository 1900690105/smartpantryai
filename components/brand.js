import { Leaf } from "lucide-react";

export default function Brand({ light = false }) {
  return (
    <div className={`flex items-center gap-2 font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${light ? "bg-white/15" : "bg-mint text-leaf"}`}>
        <Leaf size={21} aria-hidden="true" />
      </span>
      <span className="text-xl">SmartPantry <span className={light ? "text-emerald-200" : "text-leaf"}>AI</span></span>
    </div>
  );
}

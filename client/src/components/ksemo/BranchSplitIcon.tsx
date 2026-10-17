import type { SVGProps } from "react";
import { Split } from "lucide-react";

/** Consistent branch marker used in chat rows, actions, and navigation links. */
export function BranchSplitIcon(props: SVGProps<SVGSVGElement>) {
  return <Split aria-hidden="true" {...props} />;
}

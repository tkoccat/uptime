import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Dil ön ekini otomatik yöneten Link / redirect / useRouter
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

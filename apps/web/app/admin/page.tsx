"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Admin's content moved into the "Klasse" page (tabs) so organizing a class lives in one
 * place instead of being split across two pages - this just catches old bookmarks/links. */
export default function AdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/class");
  }, [router]);
  return null;
}

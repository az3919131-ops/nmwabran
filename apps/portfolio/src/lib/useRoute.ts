import { useEffect, useState } from "react";

export type Route = { name: "home" } | { name: "edit" } | { name: "dashboard" } | { name: "not-found" };

/** التوجيه بالـ hash كي يعمل الموقع على أي استضافة ثابتة بلا إعداد خادم.
 *  "#/dashboard" ← اللوحة، و"#/edit" ← الصفحة الرئيسية في وضع التحرير، و"#about" وأمثالها روابط داخل الصفحة الرئيسية. */
export function parseRoute(hash: string): Route {
  if (!hash.startsWith("#/")) return { name: "home" };
  const path = hash.slice(1).replace(/\/+$/, "");
  if (path === "" || path === "/") return { name: "home" };
  if (path === "/dashboard") return { name: "dashboard" };
  if (path === "/edit") return { name: "edit" };
  return { name: "not-found" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      const next = parseRoute(window.location.hash);
      setRoute((prev) => (prev.name === next.name ? prev : next));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

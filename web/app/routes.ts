import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sample", "routes/sample.tsx"),
  route("api/auth/*", "routes/auth.ts"),
] satisfies RouteConfig;

import type { Route } from "./+types/auth";
import { auth } from "../../auth";

export function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request);
}

export function action({ request }: Route.ActionArgs) {
  return auth.handler(request);
}

import { match } from "./src/index";

declare const data: { status: number };

const result = match(data)
  .when({ status: 200 })
  .to("success" as const)
  .when({ status: 404 })
  .to(404)
  .when({ status: 500 })
  .map(() => ({ error: true }))
  .otherwise("unknown" as const);

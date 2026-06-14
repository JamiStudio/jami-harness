# @jami-studio/harness

The canonical Harness package is the batteries-included entrypoint for users who
want the current Jami Harness owned core without selecting individual modules up
front.

```js
import { createHarness, composeHarnessCore } from "@jami-studio/harness";

const harness = createHarness();
const result = await harness.run({ runId: "run_example" });
console.log(result.status);

const core = composeHarnessCore();
console.log(core.inspect().installPaths.fullLocalHarness.status);
```

This package re-exports the published SDK, core, runtime, policy, tools, memory,
store, local provider, artifacts, and observability modules. Hosted providers,
hosted durable stores, hosted workbench/control, and hosted observability sinks
remain explicit adapter lanes; they are not silently enabled by installing this
package.

# loose-types
Sometimes TypeScript requires the use of loose types.

```bash
npx jsr add @evex/loose-types
bunx --bun add @evex/loose-types
deno add @evex/loose-types
```

## Usage

```ts
import { LooseType, LooseArray, LooseFunction, LooseObject, LoosePrimitive } from "@evex/loose-types";

value = getAnyValue() as LooseType;

const getAnyValues = () => {
    ...
    return result as LooseArray;
};

const anyFunction = getAnyValues()[0] as LooseFunction;
const anyObject = getAnyValues()[1] as LooseObject;

const anyObjectWithMustObject = getAnyValues()[1] as LooseObject<{
    foo: string;
}>;

const anyPrimitive = getAnyValues()[2] as LoosePrimitive;
```

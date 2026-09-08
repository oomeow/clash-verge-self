import type { RuleExtra } from "./RuleExtra";
import type { RuleType } from "./RuleType";
export type RuleItem = {
    index: number;
    type: RuleType;
    payload: string;
    proxy: string;
    size: number;
    extra: RuleExtra | null;
};

export type PlainObject = Record<
  string,
  string | number | boolean | object | null | undefined
>;

export const isPlainObject = (value: unknown): value is PlainObject =>
  value !== null && typeof value === "object";

export const deepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left !== typeof right) {
    return false;
  }
  if (left === null || right === null) {
    return left === right;
  }
  if (typeof left !== "object") {
    return left === right;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => deepEqual(item, right[index]))
    );
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }
  const leftEntries = Object.entries(left as PlainObject);
  const rightEntries = Object.entries(right as PlainObject);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => deepEqual(value, (right as PlainObject)[key]))
  );
};

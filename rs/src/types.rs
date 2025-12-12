use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq)]
pub enum Pattern {
    Value(JsValue),
    Object(JsValue),
    Function(JsValue),
    Wildcard,
}

#[derive(Debug, Clone)]
pub struct MatchBranch {
    pub pattern: Pattern,
    pub result: JsValue,
}

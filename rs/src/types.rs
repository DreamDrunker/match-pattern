use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq)]
pub enum Pattern {
    Value(JsValue),
    Object(JsValue),
    Function(JsValue),
    Wildcard,
}

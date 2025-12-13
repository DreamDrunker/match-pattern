use js_sys::{Array, Reflect};
use wasm_bindgen::prelude::*;

use crate::types::Pattern;

pub fn parse_patterns(patterns_js: &JsValue) -> Result<Vec<Pattern>, JsValue> {
    if !Array::is_array(patterns_js) {
        return Err(JsValue::from_str("patterns must be an array"));
    }

    Array::from(patterns_js)
        .iter()
        .map(|item| parse_pattern(&item))
        .collect()
}

pub fn parse_pattern(pattern_js: &JsValue) -> Result<Pattern, JsValue> {
    let pattern_type = Reflect::get(pattern_js, &JsValue::from_str("type"))
        .map_err(|_| JsValue::from_str("Missing 'type' field"))?;

    let type_str = pattern_type
        .as_string()
        .ok_or_else(|| JsValue::from_str("'type' must be a string"))?;

    match type_str.as_str() {
        "Value" => {
            let value = Reflect::get(pattern_js, &JsValue::from_str("value"))?;
            Ok(Pattern::Value(value))
        }
        "Object" => {
            let obj = Reflect::get(pattern_js, &JsValue::from_str("pattern"))?;
            Ok(Pattern::Object(obj))
        }
        "Function" => {
            let func_value = Reflect::get(pattern_js, &JsValue::from_str("func"))?;
            Ok(Pattern::Function(func_value))
        }
        "Wildcard" => Ok(Pattern::Wildcard),
        _ => Err(JsValue::from_str(&format!(
            "Unknown pattern type: {}",
            type_str
        ))),
    }
}

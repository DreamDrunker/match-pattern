use js_sys::{Array, Reflect};
use wasm_bindgen::prelude::*;

use crate::types::{MatchBranch, Pattern};

pub fn parse_branches(branches_js: &JsValue) -> Result<Vec<MatchBranch>, JsValue> {
    if !Array::is_array(branches_js) {
        return Err(JsValue::from_str("branches must be an array"));
    }

    Array::from(branches_js)
        .iter()
        .map(|item| {
            let pattern_js = Reflect::get(&item, &JsValue::from_str("pattern"))
                .map_err(|_| JsValue::from_str("Missing 'pattern' field"))?;

            let result = Reflect::get(&item, &JsValue::from_str("result"))
                .map_err(|_| JsValue::from_str("Missing 'result' field"))?;

            let pattern = parse_pattern(&pattern_js)?;

            Ok(MatchBranch { pattern, result })
        })
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

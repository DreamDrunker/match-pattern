mod matcher;
mod parser;
mod types;
mod utils;

pub use types::{MatchBranch, Pattern};
pub use utils::{ObjectWithProps, log};

use js_sys::{Object, Reflect};
use wasm_bindgen::prelude::*;

use crate::matcher::check_pattern;
use crate::parser::parse_branches;

#[wasm_bindgen]
pub fn match_pattern(data: JsValue, branches: JsValue) -> Result<JsValue, JsValue> {
    let branches_vec = parse_branches(&branches)?;

    for (index, branch) in branches_vec.iter().enumerate() {
        log(&format!("检查分支 {}", index));

        if check_pattern(&data, &branch.pattern)? {
            log(&format!("✓ 分支 {} 匹配！", index));
            return Ok(branch.result.clone());
        }
    }

    log("没有匹配的分支");
    Ok(JsValue::UNDEFINED)
}

#[wasm_bindgen]
pub fn test_reflect() {
    let obj = Object::new();
    Reflect::set(
        &obj,
        &JsValue::from_str("name"),
        &JsValue::from_str("Mitori"),
    )
    .unwrap();
    Reflect::set(&obj, &JsValue::from_str("age"), &JsValue::from_f64(25.0)).unwrap();

    let name = Reflect::get(&obj, &JsValue::from_str("name")).unwrap();
    log(&format!("Name: {:?}", name.as_string()));

    web_sys::console::log_1(&obj);
}

#[cfg(test)]
mod tests {
    use super::*;
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    // 导入内部模块用于测试
    use crate::matcher::{
        check_array_equal, check_object_equal, check_object_match, check_pattern, check_value_equal,
    };
    use crate::parser::parse_pattern;

    #[wasm_bindgen_test]
    fn test_pattern_enum() {
        let p1 = Pattern::Wildcard;
        let p2 = Pattern::Value(JsValue::from_str("test"));
        match p1 {
            Pattern::Wildcard => assert!(true),
            _ => panic!("should be Pattern::Wildcard"),
        };
        match p2 {
            Pattern::Value(v) => assert_eq!(v.as_string().unwrap(), "test"),
            _ => panic!("should be Pattern::Value"),
        }
    }

    #[wasm_bindgen_test]
    fn test_match_branch_creation() {
        let branch = MatchBranch {
            pattern: Pattern::Wildcard,
            result: JsValue::from_str("test"),
        };
        match branch.pattern {
            Pattern::Wildcard => assert!(true),
            _ => panic!("should be Pattern::Wildcard"),
        }
    }

    #[wasm_bindgen_test]
    fn test_value_equal_strings() {
        let a = JsValue::from_str("string");
        let b = JsValue::from_str("string");
        let c = JsValue::from_str("not string");
        assert!(check_value_equal(&a, &b).unwrap_or(false));
        assert_eq!(check_value_equal(&a, &c).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_value_equal_booleans() {
        let a = JsValue::from_bool(true);
        let b = JsValue::from_bool(true);
        let c = JsValue::from_bool(false);
        assert!(check_value_equal(&a, &b).unwrap_or(false));
        assert_eq!(check_value_equal(&a, &c).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_value_equal_nulls_and_undefineds() {
        let a = JsValue::null();
        let b = JsValue::null();
        let c = JsValue::undefined();
        let d = JsValue::undefined();
        assert!(check_value_equal(&a, &b).unwrap_or(false));
        assert!(check_value_equal(&c, &d).unwrap_or(false));
        assert_eq!(check_value_equal(&a, &c).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_array_equal() {
        use std::iter::FromIterator;
        let a = Array::from_iter([1, 2, 3].map(|value| JsValue::from(value)));
        let b = Array::from_iter([1, 2, 3].map(|value| JsValue::from(value)));
        let c = Array::from_iter([1, 2, 4].map(|value| JsValue::from(value)));

        assert!(check_array_equal(&a, &b).unwrap_or(false));
        assert_eq!(check_array_equal(&a, &c).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_object_equal() {
        let a = Object::new();
        Reflect::set(&a, &JsValue::from_str("key"), &JsValue::from_str("value")).unwrap();

        let b = Object::new();
        Reflect::set(&b, &JsValue::from_str("key"), &JsValue::from_str("value")).unwrap();

        let c = Object::new();
        Reflect::set(
            &c,
            &JsValue::from_str("key"),
            &JsValue::from_str("different"),
        )
        .unwrap();

        assert!(check_object_equal(&a, &b).unwrap_or(false));
        assert_eq!(check_object_equal(&a, &c).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_object_match_partial() {
        let pattern = Object::new();
        Reflect::set(&pattern, &JsValue::from_str("x"), &JsValue::from_str("1")).unwrap();

        let data = Object::new();
        Reflect::set(&data, &JsValue::from_str("x"), &JsValue::from_str("1")).unwrap();
        Reflect::set(&data, &JsValue::from_str("y"), &JsValue::from_str("1")).unwrap();

        assert!(check_object_match(&data, &pattern).unwrap_or(false));
    }

    #[wasm_bindgen_test]
    fn test_object_match_nested() {
        let inner_data = Object::new();
        Reflect::set(
            &inner_data,
            &JsValue::from_str("x"),
            &JsValue::from_str("1"),
        )
        .unwrap();
        Reflect::set(
            &inner_data,
            &JsValue::from_str("y"),
            &JsValue::from_str("1"),
        )
        .unwrap();

        let data = Object::new();
        Reflect::set(&data, &JsValue::from_str("inner"), &inner_data).unwrap();

        let inner_pattern = Object::new();
        Reflect::set(
            &inner_pattern,
            &JsValue::from_str("x"),
            &JsValue::from_str("1"),
        )
        .unwrap();

        let pattern = Object::new();
        Reflect::set(&pattern, &JsValue::from_str("inner"), &inner_pattern).unwrap();

        assert!(check_object_match(&data, &pattern).unwrap_or(false));
        assert_eq!(check_object_match(&pattern, &data).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_function_match() {
        let big_data = JsValue::from_f64(10.0);
        let small_data = JsValue::from_f64(1.0);
        let func = Function::new_with_args("x", "return x > 5");

        assert!(check_pattern(&big_data, &Pattern::Function(func.clone().into())).unwrap_or(false));
        assert_eq!(
            check_pattern(&small_data, &Pattern::Function(func.into())).unwrap_or(true),
            false
        );
    }

    #[wasm_bindgen_test]
    fn test_check_pattern_value() {
        let data = JsValue::from_f64(1.0);
        let pattern_same = Pattern::Value(JsValue::from_f64(1.0));
        let pattern_diff = Pattern::Value(JsValue::from_f64(2.0));

        assert!(check_pattern(&data, &pattern_same).unwrap_or(false));
        assert_eq!(check_pattern(&data, &pattern_diff).unwrap_or(true), false);
    }

    #[wasm_bindgen_test]
    fn test_check_pattern_wildcard() {
        let data = JsValue::from_f64(1.0);
        let pattern = Pattern::Wildcard;

        assert!(check_pattern(&data, &pattern).unwrap_or(false));
    }

    #[wasm_bindgen_test]
    fn test_parse_partern_value() {
        let pattern_obj = Object::new();
        Reflect::set(
            &pattern_obj,
            JsValue::from_str("type").as_ref(),
            &JsValue::from_str("Value"),
        )
        .unwrap();
        Reflect::set(
            &pattern_obj,
            &JsValue::from_str("value"),
            &JsValue::from_f64(1.0),
        )
        .unwrap();

        let res = parse_pattern(&pattern_obj).unwrap();
        assert_eq!(res, Pattern::Value(JsValue::from_f64(1.0)));
    }

    #[wasm_bindgen_test]
    fn test_parse_pattern_wildcard() {
        let pattern_obj = Object::new();
        Reflect::set(
            &pattern_obj,
            JsValue::from_str("type").as_ref(),
            &JsValue::from_str("Wildcard"),
        )
        .unwrap();

        let res = parse_pattern(&pattern_obj).unwrap();
        assert_eq!(res, Pattern::Wildcard);
    }

    #[wasm_bindgen_test]
    fn test_full_match() {
        let branches = Array::from_iter([
            Object::new()
                .with_prop(
                    "pattern",
                    Object::new()
                        .with_prop("type", "Value")
                        .with_prop("value", JsValue::from_f64(1.0)),
                )
                .with_prop("result", "matched"),
            Object::new()
                .with_prop("pattern", Object::new().with_prop("type", "Wildcard"))
                .with_prop("result", "default"),
        ]);

        let data_matched = JsValue::from_f64(1.0);
        let data_default = JsValue::from_f64(0.0);
        let result_matched = match_pattern(data_matched, branches.clone().into()).unwrap();
        let result_default = match_pattern(data_default, branches.clone().into()).unwrap();
        assert_eq!(result_matched, "matched");
        assert_eq!(result_default, "default");
    }
}

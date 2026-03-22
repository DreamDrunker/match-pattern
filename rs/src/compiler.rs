use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

const COMPILE_PLAN_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MatchProgram {
    pub branches: Vec<BranchAst>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchAst {
    #[serde(rename = "actionIndex")]
    pub action_index: Option<usize>,
    pub predicate: PredicateAst,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PredicateAst {
    IsNumber,
    IsString,
    IsBoolean,
    IsNull,
    IsUndefined,
    Eq {
        value: Value,
    },
    Tag {
        key: String,
        value: Value,
    },
    Shape {
        fields: BTreeMap<String, PredicateAst>,
        #[serde(default)]
        exact: bool,
    },
    And {
        predicates: Vec<PredicateAst>,
    },
    Or {
        predicates: Vec<PredicateAst>,
    },
    Not {
        predicate: Box<PredicateAst>,
    },
    Slot {
        slot: u32,
    },
    Wildcard,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompilePlan {
    pub version: u32,
    pub branches: Vec<CompiledBranch>,
    pub diagnostics: Vec<CompileDiagnostic>,
    #[serde(rename = "dynamicSlotCount")]
    pub dynamic_slot_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompiledBranch {
    #[serde(rename = "actionIndex")]
    pub action_index: usize,
    pub predicate: CompiledPredicate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CompiledPredicate {
    TypeOf {
        value: String,
    },
    IsNull,
    IsUndefined,
    Eq {
        value: Value,
    },
    TagEq {
        key: String,
        value: Value,
    },
    Shape {
        fields: BTreeMap<String, CompiledPredicate>,
        exact: bool,
    },
    And {
        predicates: Vec<CompiledPredicate>,
    },
    Or {
        predicates: Vec<CompiledPredicate>,
    },
    Not {
        predicate: Box<CompiledPredicate>,
    },
    Slot {
        slot: u32,
    },
    True,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompileDiagnostic {
    pub code: String,
    pub level: String,
    pub message: String,
    #[serde(rename = "branchIndex")]
    pub branch_index: usize,
}

pub fn compile_program(program: &MatchProgram) -> CompilePlan {
    let mut diagnostics = Vec::new();
    let mut compiled_branches = Vec::new();
    let mut previous = Vec::new();
    let mut dynamic_slot_count = 0usize;

    for (branch_index, branch) in program.branches.iter().enumerate() {
        let action_index = branch.action_index.unwrap_or(branch_index);
        let predicate = lower_predicate(&branch.predicate);

        if previous.iter().any(|item| covers(item, &predicate)) {
            diagnostics.push(CompileDiagnostic {
                code: "unreachable_branch".to_string(),
                level: "warning".to_string(),
                message: format!(
                    "branch {} is shadowed by a previous predicate",
                    branch_index
                ),
                branch_index,
            });
        }

        if contains_slot(&predicate) {
            diagnostics.push(CompileDiagnostic {
                code: "dynamic_slot".to_string(),
                level: "info".to_string(),
                message: format!(
                    "branch {} contains runtime slot predicate and cannot be fully proven at compile time",
                    branch_index
                ),
                branch_index,
            });
        }

        dynamic_slot_count = dynamic_slot_count.max(max_slot_index(&predicate).saturating_add(1));
        previous.push(predicate.clone());
        compiled_branches.push(CompiledBranch {
            action_index,
            predicate,
        });
    }

    CompilePlan {
        version: COMPILE_PLAN_VERSION,
        branches: compiled_branches,
        diagnostics,
        dynamic_slot_count,
    }
}

fn lower_predicate(predicate: &PredicateAst) -> CompiledPredicate {
    match predicate {
        PredicateAst::IsNumber => CompiledPredicate::TypeOf {
            value: "number".to_string(),
        },
        PredicateAst::IsString => CompiledPredicate::TypeOf {
            value: "string".to_string(),
        },
        PredicateAst::IsBoolean => CompiledPredicate::TypeOf {
            value: "boolean".to_string(),
        },
        PredicateAst::IsNull => CompiledPredicate::IsNull,
        PredicateAst::IsUndefined => CompiledPredicate::IsUndefined,
        PredicateAst::Eq { value } => CompiledPredicate::Eq {
            value: value.clone(),
        },
        PredicateAst::Tag { key, value } => CompiledPredicate::TagEq {
            key: key.clone(),
            value: value.clone(),
        },
        PredicateAst::Shape { fields, exact } => CompiledPredicate::Shape {
            fields: fields
                .iter()
                .map(|(key, node)| (key.clone(), lower_predicate(node)))
                .collect(),
            exact: *exact,
        },
        PredicateAst::And { predicates } => {
            let flattened = predicates
                .iter()
                .map(lower_predicate)
                .flat_map(|node| match node {
                    CompiledPredicate::And { predicates } => predicates,
                    other => vec![other],
                })
                .collect();
            CompiledPredicate::And {
                predicates: flattened,
            }
        }
        PredicateAst::Or { predicates } => {
            let flattened = predicates
                .iter()
                .map(lower_predicate)
                .flat_map(|node| match node {
                    CompiledPredicate::Or { predicates } => predicates,
                    other => vec![other],
                })
                .collect();
            CompiledPredicate::Or {
                predicates: flattened,
            }
        }
        PredicateAst::Not { predicate } => CompiledPredicate::Not {
            predicate: Box::new(lower_predicate(predicate)),
        },
        PredicateAst::Slot { slot } => CompiledPredicate::Slot { slot: *slot },
        PredicateAst::Wildcard => CompiledPredicate::True,
    }
}

fn covers(previous: &CompiledPredicate, current: &CompiledPredicate) -> bool {
    if matches!(previous, CompiledPredicate::True) {
        return true;
    }
    if previous == current {
        return true;
    }

    match (previous, current) {
        (
            CompiledPredicate::TypeOf { value },
            CompiledPredicate::Eq {
                value: current_value,
            },
        ) => matches_type(value, current_value),
        (
            CompiledPredicate::TagEq {
                key: previous_key,
                value: previous_value,
            },
            CompiledPredicate::TagEq {
                key: current_key,
                value: current_value,
            },
        ) => previous_key == current_key && previous_value == current_value,
        (
            CompiledPredicate::TagEq {
                key: previous_key,
                value: previous_value,
            },
            CompiledPredicate::And { predicates },
        ) => predicates.iter().any(|node| {
            matches!(
                node,
                CompiledPredicate::TagEq { key, value }
                    if key == previous_key && value == previous_value
            )
        }),
        (
            CompiledPredicate::Shape {
                fields: previous_fields,
                exact: previous_exact,
            },
            CompiledPredicate::Shape {
                fields: current_fields,
                exact: current_exact,
            },
        ) => {
            let is_subset = previous_fields.iter().all(|(key, previous_value)| {
                current_fields
                    .get(key)
                    .map(|current_value| covers(previous_value, current_value))
                    .unwrap_or(false)
            });
            if !is_subset {
                return false;
            }
            if *previous_exact {
                previous_fields.len() == current_fields.len() && *current_exact
            } else {
                true
            }
        }
        _ => false,
    }
}

fn matches_type(type_name: &str, value: &Value) -> bool {
    match type_name {
        "number" => value.is_number(),
        "string" => value.is_string(),
        "boolean" => value.is_boolean(),
        "object" => value.is_object(),
        _ => false,
    }
}

fn contains_slot(predicate: &CompiledPredicate) -> bool {
    match predicate {
        CompiledPredicate::Slot { .. } => true,
        CompiledPredicate::And { predicates } | CompiledPredicate::Or { predicates } => {
            predicates.iter().any(contains_slot)
        }
        CompiledPredicate::Not { predicate } => contains_slot(predicate),
        CompiledPredicate::Shape { fields, .. } => fields.values().any(contains_slot),
        _ => false,
    }
}

fn max_slot_index(predicate: &CompiledPredicate) -> usize {
    match predicate {
        CompiledPredicate::Slot { slot } => *slot as usize,
        CompiledPredicate::And { predicates } | CompiledPredicate::Or { predicates } => {
            predicates.iter().map(max_slot_index).max().unwrap_or(0)
        }
        CompiledPredicate::Not { predicate } => max_slot_index(predicate),
        CompiledPredicate::Shape { fields, .. } => {
            fields.values().map(max_slot_index).max().unwrap_or(0)
        }
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn branch(predicate: PredicateAst) -> BranchAst {
        BranchAst {
            action_index: None,
            predicate,
        }
    }

    #[test]
    fn test_lower_number_tag_shape() {
        let mut fields = BTreeMap::new();
        fields.insert(
            "type".to_string(),
            PredicateAst::Eq {
                value: json!("pay"),
            },
        );
        let program = MatchProgram {
            branches: vec![branch(PredicateAst::And {
                predicates: vec![
                    PredicateAst::IsNumber,
                    PredicateAst::Tag {
                        key: "kind".to_string(),
                        value: json!("event"),
                    },
                    PredicateAst::Shape {
                        fields,
                        exact: false,
                    },
                ],
            })],
        };

        let plan = compile_program(&program);
        assert_eq!(plan.branches.len(), 1);
        assert!(matches!(
            &plan.branches[0].predicate,
            CompiledPredicate::And { predicates } if predicates.len() == 3
        ));
    }

    #[test]
    fn test_shadow_detection_by_typeof() {
        let program = MatchProgram {
            branches: vec![
                branch(PredicateAst::IsNumber),
                branch(PredicateAst::Eq { value: json!(1) }),
            ],
        };

        let plan = compile_program(&program);
        assert!(
            plan.diagnostics
                .iter()
                .any(|item| item.code == "unreachable_branch" && item.branch_index == 1)
        );
    }

    #[test]
    fn test_shadow_detection_by_tag() {
        let program = MatchProgram {
            branches: vec![
                branch(PredicateAst::Tag {
                    key: "type".to_string(),
                    value: json!("pay"),
                }),
                branch(PredicateAst::And {
                    predicates: vec![
                        PredicateAst::Tag {
                            key: "type".to_string(),
                            value: json!("pay"),
                        },
                        PredicateAst::Eq {
                            value: json!("any"),
                        },
                    ],
                }),
            ],
        };

        let plan = compile_program(&program);
        assert!(
            plan.diagnostics
                .iter()
                .any(|item| item.code == "unreachable_branch" && item.branch_index == 1)
        );
    }

    #[test]
    fn test_dynamic_slot_diagnostic() {
        let program = MatchProgram {
            branches: vec![branch(PredicateAst::Slot { slot: 2 })],
        };

        let plan = compile_program(&program);
        assert_eq!(plan.dynamic_slot_count, 3);
        assert!(
            plan.diagnostics
                .iter()
                .any(|item| item.code == "dynamic_slot" && item.branch_index == 0)
        );
    }
}

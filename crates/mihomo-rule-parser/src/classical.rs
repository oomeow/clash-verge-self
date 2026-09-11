use crate::{
    Codec, RuleBehavior, RuleFormat,
    error::{Result, RuleParseError},
    utils,
};

/// classical parse strategy
pub(crate) struct ClassicalCodecStrategy;

impl Codec for ClassicalCodecStrategy {
    fn parse(buf: &[u8], format: crate::RuleFormat) -> Result<crate::RulePayload> {
        match format {
            RuleFormat::Mrs => Err(RuleParseError::UnsupportedFormat(
                RuleBehavior::Classical,
                RuleFormat::Mrs,
            )),
            RuleFormat::Yaml => utils::parse_from_yaml(buf),
            RuleFormat::Text => utils::parse_from_text(buf),
        }
    }

    fn export<P: AsRef<std::path::Path>>(_rules: &[String], _file_path: P, format: RuleFormat) -> Result<()> {
        Err(RuleParseError::UnsupportedExportFormat(RuleBehavior::Classical, format))
    }
}

// ------------------------------ Test ------------------------------------

#[cfg(test)]
#[allow(deprecated)]
mod tests {

    use std::io::Read;

    use super::*;

    #[test]
    fn test_classical_parse_from_mrs() -> Result<()> {
        let rules_dir = crate::test_utils::init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.mrs"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = ClassicalCodecStrategy::parse(&buf, RuleFormat::Mrs);
        assert!(matches!(
            payload,
            Err(RuleParseError::UnsupportedFormat(
                RuleBehavior::Classical,
                RuleFormat::Mrs
            ))
        ));
        Ok(())
    }

    #[test]
    fn test_classical_parse_from_yaml() -> Result<()> {
        let rules_dir = crate::test_utils::init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/classical/ad.yaml"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = ClassicalCodecStrategy::parse(&buf, RuleFormat::Yaml)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_classical_parse_from_text() -> Result<()> {
        let rules_dir = crate::test_utils::init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/classical/ad.list"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = ClassicalCodecStrategy::parse(&buf, RuleFormat::Text)?;
        println!("payload: {:?}", payload);
        Ok(())
    }
}

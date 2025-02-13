//! Importing profiles that have been shared on Thunderstore.

use std::{io::Read, ops::Deref};

use anyhow::{ensure, Context, Result};
use base64::prelude::BASE64_STANDARD;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{http::fetch_as_blocking, Reqwest};

#[derive(Clone)]
pub struct FullName {
    value: String,
    split: usize,
}

impl FullName {
    pub fn namespace(&self) -> &str {
        &self.value[..self.split]
    }

    pub fn name(&self) -> &str {
        &self.value[self.split + 1..]
    }

    pub fn components(&self) -> (&str, &str) {
        (self.namespace(), self.name())
    }
}

impl Deref for FullName {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

impl From<FullName> for String {
    fn from(value: FullName) -> Self {
        value.value
    }
}

impl std::fmt::Display for FullName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.value)
    }
}

impl std::fmt::Debug for FullName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FullName")
            .field("namespace", &self.namespace())
            .field("name", &self.name())
            .finish()
    }
}

impl<'de> serde::Deserialize<'de> for FullName {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct Visitor;

        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = FullName;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a string containing a hyphen separated namespace and name")
            }

            fn visit_str<E>(self, v: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                let split = v.find('-').ok_or_else(|| {
                    E::invalid_value(
                        serde::de::Unexpected::Str(v),
                        &"a hyphen separated namespace and name",
                    )
                })?;
                Ok(FullName { value: v.to_owned(), split })
            }

            fn visit_string<E>(self, v: String) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                let split = v.find('-').ok_or_else(|| {
                    E::invalid_value(
                        serde::de::Unexpected::Str(&v),
                        &"a hyphen separated namespace and name",
                    )
                })?;
                Ok(FullName { value: v, split })
            }
        }

        deserializer.deserialize_string(Visitor)
    }
}

impl serde::Serialize for FullName {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.value)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

#[derive(Debug)]
pub struct Profile {
    pub manifest: ProfileManifest,
    pub archive: zip::ZipArchive<std::io::Cursor<Vec<u8>>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileManifest {
    pub profile_name: String,
    pub mods: Vec<ProfileMod>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProfileMod {
    #[serde(rename = "name")]
    pub full_name: FullName,
    #[serde(alias = "versionNumber")]
    pub version: Version,
    pub enabled: bool,
}

const R2_PROFILE_DATA_PREFIX: &str = "#r2modman\n";

pub const R2_PROFILE_MANIFEST_FILE_NAME: &str = "export.r2x";

pub async fn lookup_profile(client: &Reqwest, id: Uuid) -> Result<Profile> {
    let mut rdr = fetch_as_blocking(client.get(format!(
        "https://thunderstore.io/api/experimental/legacyprofile/get/{id}/"
    )))
    .await?;

    tokio::task::block_in_place(move || {
        {
            const BUF_LEN: usize = R2_PROFILE_DATA_PREFIX.len();
            let mut buf = [0u8; BUF_LEN];
            rdr.read_exact(&mut buf)?;
            ensure!(
                buf == R2_PROFILE_DATA_PREFIX.as_bytes(),
                "Invalid profile data"
            );
        }

        let mut buf = Vec::new();
        base64::read::DecoderReader::new(rdr, &BASE64_STANDARD)
            .read_to_end(&mut buf)
            .context("Failed to decode base64 data")?;

        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(buf))?;

        let manifest_file = archive
            .by_name("export.r2x")
            .context("Profile archive is missing manifest file")?;

        let manifest = serde_yaml::from_reader(manifest_file)?;

        Ok(Profile { manifest, archive })
    })
}

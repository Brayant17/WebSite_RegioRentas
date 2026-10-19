import { useCallback, useEffect, useState } from "react";
import { contractErrorMessage } from "../../services/contratos.service";
import { listDraftTemplateVersions, loadContractTemplatePreview } from "../services/template.service";
import { createPreviewDocument } from "../sanitize";
import type { TemplateVersionOption } from "../types";
import type { EmptyFieldWarning } from "../utils/contextWarnings";

export function useContractTemplatePreview(contractId: string) {
  const [versions, setVersions] = useState<TemplateVersionOption[]>([]);
  const [versionId, setVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ document: string; unresolvedVariables: string[]; emptyFields: EmptyFieldWarning[]; compatibilityWarnings: string[]; versionId: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);
  const reload = useCallback(() => { setVersionId(""); setPreview(null); setRevision(value => value + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingVersions(true);
    setVersionsError(null);
    setVersions([]);
    listDraftTemplateVersions().then(options => {
      if (cancelled) return;
      setVersions(options);
      setVersionId(options.length === 1 ? options[0].id : "");
    }).catch((error: unknown) => {
      if (!cancelled) setVersionsError(contractErrorMessage(error));
    }).finally(() => { if (!cancelled) setLoadingVersions(false); });
    return () => { cancelled = true; };
  }, [revision]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(Boolean(versionId));
    if (!versionId) return;
    loadContractTemplatePreview(contractId, versionId).then(result => {
      if (cancelled) return;
      setPreview({ document: createPreviewDocument(result.html), unresolvedVariables: result.unresolvedVariables, emptyFields: result.emptyFields, compatibilityWarnings: result.compatibilityWarnings, versionId: result.version.id });
    }).catch((error: unknown) => {
      if (!cancelled) setPreviewError(contractErrorMessage(error));
    }).finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [contractId, versionId, previewRevision]);

  return {
    versions, versionId, loadingVersions, versionsError, preview, loadingPreview, previewError, reload,
    selectVersion: (id: string) => { setPreview(null); setPreviewError(null); setVersionId(id); },
    refreshPreview: () => { setPreview(null); setPreviewRevision(value => value + 1); },
  };
}

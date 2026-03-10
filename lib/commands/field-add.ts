import { getProjectNumber, getOrg, gh, graphql, getItems, getFields, getProjectId } from "../github";

export async function fieldAdd(fieldName: string, newOption: string) {
  const fields = await getFields();
  const field = fields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase() && f.type === "ProjectV2SingleSelectField"
  );

  if (!field || !field.options) {
    console.error(`Field "${fieldName}" not found or not a select field.`);
    console.log("Available:", fields.filter((f) => f.options).map((f) => f.name).join(", "));
    return;
  }

  const existing = field.options.map((o) => o.name);
  if (existing.includes(newOption)) {
    console.log(`"${newOption}" already exists in ${fieldName}.`);
    return;
  }

  const items = await getItems();
  const currentValues: { id: string; value: string }[] = [];
  const fieldKey = fieldName.toLowerCase();
  for (const item of items) {
    const val = (item as any)[fieldKey];
    if (val) currentValues.push({ id: item.id, value: val });
  }

  console.log(`Backing up ${currentValues.length} values for "${fieldName}"...`);

  await graphql(`mutation { deleteProjectV2Field(input: { fieldId: "${field.id}" }) { projectV2Field { ... on ProjectV2SingleSelectField { name } } } }`);

  const allOptions = [...existing, newOption].join(",");
  await gh("project", "field-create", String(getProjectNumber()), "--owner", getOrg(),
    "--name", fieldName, "--data-type", "SINGLE_SELECT", "--single-select-options", allOptions);

  const newFields = await getFields();
  const newField = newFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())!;

  const projectId = await getProjectId();
  let restored = 0;
  for (const { id, value } of currentValues) {
    const opt = newField.options!.find((o) => o.name === value);
    if (opt) {
      await gh("project", "item-edit", "--project-id", projectId,
        "--id", id, "--field-id", newField.id, "--single-select-option-id", opt.id);
      restored++;
    }
  }

  console.log(`Added "${newOption}" to ${fieldName}. Restored ${restored}/${currentValues.length} values.`);
}

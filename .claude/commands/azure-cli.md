---
description: 💠 Azure CLI — Cloud Resources, Blob Storage, VMs, Functions
argument-hint: [storage|vm|functions] [--resource-group=my-rg]
---

**Think harder** để azure cli: <$ARGUMENTS>

**IMPORTANT:** Azure credentials PHẢI qua az login, use managed identities.

## Azure Setup

```bash
# === Login ===
az login

# === List Subscriptions ===
az account list --output table

# === Set Subscription ===
az account set --subscription "subscription-id"

# === List Resource Groups ===
az group list --output table
```

## Blob Storage

```bash
# === List Containers ===
az storage container list --account-name mystorageaccount

# === Create Container ===
az storage container create --name mycontainer --account-name mystorageaccount

# === Upload Blob ===
az storage blob upload --container-name mycontainer --name path/file.txt --file ./file.txt --account-name mystorageaccount

# === Download Blob ===
az storage blob download --container-name mycontainer --name path/file.txt --file ./file.txt --account-name mystorageaccount

# === List Blobs ===
az storage blob list --container-name mycontainer --account-name mystorageaccount

# === Delete Blob ===
az storage blob delete --container-name mycontainer --name path/file.txt --account-name mystorageaccount

# === SAS Token ===
az storage blob generate-sas --container-name mycontainer --name file.txt --account-name mystorageaccount --permissions r --expiry 2024-12-31
```

## Virtual Machines

```bash
# === List VMs ===
az vm list --output table

# === Create VM ===
az vm create --resource-group my-rg --name my-vm --image Ubuntu2204 --size Standard_B2s --admin-username azureuser --generate-ssh-keys

# === Start VM ===
az vm start --resource-group my-rg --name my-vm

# === Stop VM ===
az vm stop --resource-group my-rg --name my-vm

# === Delete VM ===
az vm delete --resource-group my-rg --name my-vm --yes
```

## Azure Functions

```bash
# === List Functions ===
az functionapp list --resource-group my-rg

# === Deploy Function ===
func azure functionapp publish my-function-app

# === View Logs ===
az functionapp log tail --name my-function-app --resource-group my-rg

# === Configure Settings ===
az functionapp config appsettings set --name my-function-app --resource-group my-rg --settings KEY=value
```

## Related Commands

- `/aws-cli` — Amazon Web Services
- `/gcp-cli` — Google Cloud Platform
- `/deploy` — Deploy application

# Bootstrap Action

[![Build Status][build-badge]][build-badge-url]
[![Coverage Status][coverage-badge]][coverage-badge-url]
[![License][license-badge]][license-badge-url]

A GitHub Action to bootstrap other actions using release assets.

## Usage

### Inputs

| Name   | Required | Default            | Description                                      |
| ------ | -------- | ------------------ | ------------------------------------------------ |
| `repo` | `false`  | Current Repository | The repository owner/repo identifier pair.       |
| `tags` | `false`  | `latest`           | A comma-separated list of release tags to query. |
| `name` | `true`   |                    | The release asset name to match against.         |
| `main` | `true`   |                    | The command to run in the main step.             |

### Example

The following is an example action that demonstrates the use of this action with
a single input and a single output.

```yml
name: My Action
description: My Action Description.

inputs:
  my_input:
    description: My Action Input.
    required: true

outputs:
  my_output:
    description: My Action Output.
    value: ${{ steps.bootstrap.outputs.my_output }}

runs:
  using: composite
  steps:
  - id: bootstrap
    name: Bootstrap
    uses: ploys/bootstrap@main
    with:
      repo: my-org/my-repo
      tags: 1, 1.0, 1.0.0, latest
      name: my-asset
      main: my-bin --my-input "${{ inputs.my_input }}"
```

### Notes

* Inputs must be explicitly passed to the `main` command or to the `bootstrap`
  action using environment variables.
* Outputs must be set within the executed command according to the official
  documentation and are re-exported through the `bootstrap` action.

## License

This project is dual licensed under the following licenses at your discretion:

* [Apache License, Version 2.0](LICENSE-APACHE)
* [MIT License](LICENSE-MIT)

### Contribution

Unless explicitly stated otherwise any contribution intentionally submitted for
inclusion in the work shall be dual licensed as above without additional terms
or conditions.

[build-badge]: https://img.shields.io/github/workflow/status/ploys/bootstrap/CI/main
[build-badge-url]: https://github.com/ploys/bootstrap/actions?query=workflow%3ACI
[coverage-badge]: https://img.shields.io/codecov/c/github/ploys/bootstrap/main
[coverage-badge-url]: https://codecov.io/gh/ploys/bootstrap
[license-badge]: https://img.shields.io/badge/license-MIT%20OR%20Apache%202.0-blue.svg
[license-badge-url]: https://github.com/ploys/bootstrap#license

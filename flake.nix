{
  description = "GLSL学習用サンプルプロジェクト";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            corepack_22
          ];

          shellHook = ''
            echo "GLSL学習環境へようこそ!"
            echo "npm install && npm run dev で開発サーバーを起動"
          '';
        };
      }
    );
}

import DynamicProviderImpl from "../../lib/DynamicProviderImpl";
import DynamicEmbeddedWalletPanelImpl from "./DynamicEmbeddedWalletPanelImpl";

type DynamicEmbeddedWalletPanelWithProviderProps = {
  onWalletReady?: () => void;
};

export default function DynamicEmbeddedWalletPanelWithProvider(props: DynamicEmbeddedWalletPanelWithProviderProps) {
  return (
    <DynamicProviderImpl>
      <DynamicEmbeddedWalletPanelImpl {...props} />
    </DynamicProviderImpl>
  );
}

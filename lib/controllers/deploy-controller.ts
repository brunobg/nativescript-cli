export class DeployController {

	constructor(
		private $deviceInstallAppService: IDeviceInstallAppService,
		private $devicesService: Mobile.IDevicesService,
		private $prepareController: IPrepareController
	) { }

	public async deploy(data: IDeployData): Promise<void> {
		const { deviceDescriptors } = data;

		const executeAction = async (device: Mobile.IDevice) => {
			const deviceDescriptor = _.find(deviceDescriptors, dd => dd.identifier === device.deviceInfo.identifier);
			await this.$prepareController.prepare(deviceDescriptor.buildData);
			const packageFilePath = await deviceDescriptor.buildAction();
			await this.$deviceInstallAppService.installOnDevice(device, { ...deviceDescriptor.buildData, buildForDevice: !device.isEmulator }, packageFilePath);
		};

		await this.$devicesService.execute(executeAction, (device: Mobile.IDevice) => _.some(deviceDescriptors, deviceDescriptor => deviceDescriptor.identifier === device.deviceInfo.identifier));
	}
}
$injector.register("deployController", DeployController);

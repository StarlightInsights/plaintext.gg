class Announcer {
  message = $state('');

  announce(msg: string): void {
    this.message = '';
    requestAnimationFrame(() => {
      this.message = msg;
    });
  }
}

export const announcer = new Announcer();

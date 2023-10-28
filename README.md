# Crystal Manager

* Automatically equips crystals configured in ```config.json``` at login from either bank or inventory.
* Automatically banks crystals either currently equipped or in inventory at logout (Does not bank all crystals, only those potentially required on other characters).

## Commands
```!cm``` enables/disables crystal manager.

## Noteworthy

* Make sure you have enough empty slots in your inventory and 1st bank page.
* If you do not want any crystals touched, put them into the bank on any other page but 1st.
* Might not work properly if u have high ping. Increase `delay` in `config.json` in that case (1000 should work).

## Credits

Thank you Kasea for this beautiful [library](https://github.com/tera-toolbox-mods/library).
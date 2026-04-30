#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "terminal-a";

void app_main(void)
{
    int count = 0;
    while (1) {
        ESP_LOGI(TAG, "telemetry -> device=term-a state=RUNNING output=%d temp=%.1f fault=%d",
                 100 + (count % 20), 26.0f + (count % 5) * 0.2f, (count % 19 == 0) ? 101 : 0);
        count++;
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}
